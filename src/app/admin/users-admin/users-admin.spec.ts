import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UsersAdmin } from './users-admin';

describe('UsersAdmin', () => {
  let component: UsersAdmin;
  let fixture: ComponentFixture<UsersAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsersAdmin]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UsersAdmin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
