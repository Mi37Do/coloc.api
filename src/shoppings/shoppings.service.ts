import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { ShoppingList } from './entities/shopping-list.entity.js';
import { ShoppingItem } from './entities/shopping-item.entity.js';
import {
  CreateShoppingItemDto,
  CreateShoppingListDto,
  UpdateShoppingItemDto,
  UpdateShoppingListDto,
} from './dto/shopping.dto.js';

const PUBLIC_USER = { id: true, username: true, firstname: true, lastname: true };

@Injectable()
export class ShoppingsService {
  constructor(
    @InjectRepository(ShoppingList)
    private readonly lists: Repository<ShoppingList>,
    @InjectRepository(ShoppingItem)
    private readonly items: Repository<ShoppingItem>,
  ) {}

  // --- Lists ---

  async createList(householdId: string, userId: string, dto: CreateShoppingListDto) {
    const list = await this.lists.save(
      this.lists.create({ ...dto, householdId, createdById: userId }),
    );
    return this.findList(householdId, list.id);
  }

  /** Lists with a count of items still to buy */
  async findLists(householdId: string, archived = false) {
    const lists = await this.lists.find({
      where: {
        householdId,
        archivedAt: archived ? Not(IsNull()) : IsNull(),
      },
      order: { updatedAt: 'DESC' },
    });
    if (!lists.length) return [];

    const counts = await this.items
      .createQueryBuilder('item')
      .select('item.listId', 'listId')
      .addSelect('COUNT(*)::int', 'remaining')
      .where('item.listId IN (:...ids)', { ids: lists.map((l) => l.id) })
      .andWhere('item.checkedAt IS NULL')
      .groupBy('item.listId')
      .getRawMany<{ listId: string; remaining: number }>();
    const remaining = new Map(counts.map((c) => [c.listId, c.remaining]));

    return lists.map((list) => ({
      ...list,
      remainingCount: remaining.get(list.id) ?? 0,
    }));
  }

  async findList(householdId: string, id: string) {
    const list = await this.lists.findOne({
      where: { id, householdId },
      relations: { items: { addedBy: true, checkedBy: true } },
      select: {
        items: {
          id: true,
          name: true,
          quantity: true,
          unit: true,
          note: true,
          checkedAt: true,
          createdAt: true,
          addedBy: PUBLIC_USER,
          checkedBy: PUBLIC_USER,
        },
      },
      // Unchecked first, then in the order they were added
      order: {
        items: { checkedAt: { direction: 'ASC', nulls: 'FIRST' }, createdAt: 'ASC' },
      },
    });
    if (!list) throw new NotFoundException('Shopping list not found');
    return list;
  }

  async updateList(householdId: string, id: string, dto: UpdateShoppingListDto) {
    const list = await this.findList(householdId, id);
    const { archived, ...fields } = dto;
    await this.lists.update(list.id, {
      ...fields,
      ...(archived !== undefined && {
        archivedAt: archived ? new Date() : null,
      }),
    });
    return this.findList(householdId, id);
  }

  async removeList(householdId: string, id: string) {
    await this.lists.delete({ id, householdId });
  }

  /** Removes everything already bought */
  async clearChecked(householdId: string, listId: string) {
    const list = await this.findList(householdId, listId);
    await this.items.delete({ listId: list.id, checkedAt: Not(IsNull()) });
    return this.findList(householdId, listId);
  }

  // --- Items ---

  async addItem(
    householdId: string,
    listId: string,
    userId: string,
    dto: CreateShoppingItemDto,
  ) {
    const list = await this.findList(householdId, listId);
    await this.items.save(
      this.items.create({ ...dto, listId: list.id, addedById: userId }),
    );
    await this.touch(list.id);
    return this.findList(householdId, listId);
  }

  async updateItem(
    householdId: string,
    listId: string,
    itemId: string,
    dto: UpdateShoppingItemDto,
  ) {
    const item = await this.findItem(householdId, listId, itemId);
    await this.items.update(item.id, dto);
    await this.touch(listId);
    return this.findList(householdId, listId);
  }

  async setChecked(
    householdId: string,
    listId: string,
    itemId: string,
    userId: string,
    checked: boolean,
  ) {
    const item = await this.findItem(householdId, listId, itemId);
    await this.items.update(item.id, {
      checkedAt: checked ? new Date() : null,
      checkedById: checked ? userId : null,
    });
    await this.touch(listId);
    return this.findList(householdId, listId);
  }

  async removeItem(householdId: string, listId: string, itemId: string) {
    const item = await this.findItem(householdId, listId, itemId);
    await this.items.delete(item.id);
    await this.touch(listId);
  }

  private async findItem(householdId: string, listId: string, itemId: string) {
    const item = await this.items.findOne({
      where: { id: itemId, listId, list: { householdId } },
    });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  /** Bumps updatedAt so recently used lists sort first */
  private touch(listId: string) {
    return this.lists.update(listId, { updatedAt: new Date() });
  }
}
