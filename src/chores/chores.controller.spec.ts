import { Test, TestingModule } from '@nestjs/testing';
import { ChoresController } from './chores.controller.js';
import { ChoresService } from './chores.service.js';

describe('ChoresController', () => {
  let controller: ChoresController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChoresController],
      providers: [ChoresService],
    }).compile();

    controller = module.get<ChoresController>(ChoresController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
