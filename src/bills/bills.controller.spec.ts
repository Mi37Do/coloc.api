import { Test, TestingModule } from '@nestjs/testing';
import { BillsController } from './bills.controller.js';
import { BillsService } from './bills.service.js';

describe('BillsController', () => {
  let controller: BillsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillsController],
      providers: [BillsService],
    }).compile();

    controller = module.get<BillsController>(BillsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
