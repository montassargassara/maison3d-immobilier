import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AgentsAdmin } from './agents-admin';

describe('AgentsAdmin', () => {
  let component: AgentsAdmin;
  let fixture: ComponentFixture<AgentsAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgentsAdmin]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AgentsAdmin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
