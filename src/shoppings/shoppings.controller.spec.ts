import { Test, TestingModule } from '@nestjs/testing';
import { ShoppingsController } from './shoppings.controller.js';
import { ShoppingsService } from './shoppings.service.js';

describe('ShoppingsController', () => {
  let controller: ShoppingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShoppingsController],
      providers: [ShoppingsService],
    }).compile();

    controller = module.get<ShoppingsController>(ShoppingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
