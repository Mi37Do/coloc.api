import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { ShoppingList } from './shopping-list.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('shopping_items')
export class ShoppingItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  listId: string;

  @ManyToOne(() => ShoppingList, (list) => list.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listId' })
  list: Relation<ShoppingList>;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  /** Free text: "kg", "pack", "bottles"... */
  @Column({ type: 'varchar', length: 20, nullable: true })
  unit: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @Column({ type: 'uuid', nullable: true })
  addedById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'addedById' })
  addedBy: Relation<User> | null;

  /** Who bought it */
  @Column({ type: 'uuid', nullable: true })
  checkedById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'checkedById' })
  checkedBy: Relation<User> | null;

  @Column({ type: 'timestamptz', nullable: true })
  checkedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
