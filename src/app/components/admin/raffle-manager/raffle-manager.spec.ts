import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RaffleManager } from './raffle-manager';

describe('RaffleManager', () => {
  let component: RaffleManager;
  let fixture: ComponentFixture<RaffleManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RaffleManager]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RaffleManager);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
