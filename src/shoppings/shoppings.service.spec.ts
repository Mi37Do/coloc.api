import { Test, TestingModule } from '@nestjs/testing';
import { ShoppingsService } from './shoppings.service.js';

describe('ShoppingsService', () => {
  let service: ShoppingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShoppingsService],
    }).compile();

    service = module.get<ShoppingsService>(ShoppingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
