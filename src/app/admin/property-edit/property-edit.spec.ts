import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PropertyEdit } from './property-edit';

describe('PropertyEdit', () => {
  let component: PropertyEdit;
  let fixture: ComponentFixture<PropertyEdit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PropertyEdit]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PropertyEdit);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
