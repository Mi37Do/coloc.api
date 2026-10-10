import { Test, TestingModule } from '@nestjs/testing';
import { HouseholdController } from './household.controller.js';
import { HouseholdService } from './household.service.js';

describe('HouseholdController', () => {
  let controller: HouseholdController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HouseholdController],
      providers: [HouseholdService],
    }).compile();

    controller = module.get<HouseholdController>(HouseholdController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
