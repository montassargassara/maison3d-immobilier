import { TestBed } from '@angular/core/testing';

import { AdminData } from './admin-data';

describe('AdminData', () => {
  let service: AdminData;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AdminData);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
