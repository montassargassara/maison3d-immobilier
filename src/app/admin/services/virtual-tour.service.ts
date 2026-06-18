import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType, HttpRequest } from '@angular/common/http';
import { Observable, filter, map } from 'rxjs';
import { apiBaseUrl } from '../../services/api-config';

export interface VirtualTourSceneDTO {
  id: number;
  tourId: number;
  sceneIndex: number;
  sceneName: string;
  imageUrl: string;
  thumbnailUrl: string;
  timestampSeconds: number | null;
  isDefault: boolean;
}

export interface VirtualTourDTO {
  id: number;
  propertyId: number;
  status: 'NOT_CREATED' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  sceneCount: number;
  processingProgress: number;
  errorMessage: string | null;
  is360: boolean;
  videoDurationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
  scenes: VirtualTourSceneDTO[];
}

export interface UploadProgress {
  type: 'progress' | 'done';
  percent?: number;
  tour?: VirtualTourDTO;
}

@Injectable({ providedIn: 'root' })
export class VirtualTourService {
  private readonly base = `${apiBaseUrl}/api/virtual-tour`;

  constructor(private http: HttpClient) {}

  /** Generate a tour attached to an existing property. */
  generateTour(propertyId: number, file: File, is360: boolean): Observable<UploadProgress> {
    return this._upload(`${this.base}/generate/${propertyId}`, file, is360);
  }

  /** Generate a standalone tour with no property required. */
  generateStandaloneTour(file: File, is360: boolean): Observable<UploadProgress> {
    return this._upload(`${this.base}/generate-standalone`, file, is360);
  }

  private _upload(url: string, file: File, is360: boolean): Observable<UploadProgress> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('is360', String(is360));
    const req = new HttpRequest('POST', url, formData, { reportProgress: true });
    return this.http.request<VirtualTourDTO>(req).pipe(
      filter(e => e.type === HttpEventType.UploadProgress || e.type === HttpEventType.Response),
      map(e => {
        if (e.type === HttpEventType.UploadProgress) {
          const percent = e.total ? Math.round((100 * e.loaded) / e.total) : 0;
          return { type: 'progress' as const, percent };
        }
        if (e.type === HttpEventType.Response) {
          return { type: 'done' as const, tour: e.body! };
        }
        return { type: 'progress' as const, percent: 0 };
      })
    );
  }

  getTour(propertyId: number): Observable<VirtualTourDTO> {
    return this.http.get<VirtualTourDTO>(`${this.base}/${propertyId}`);
  }

  /** Load a completed tour (with scenes) by its own ID — used for standalone tours. */
  getTourById(tourId: number): Observable<VirtualTourDTO> {
    return this.http.get<VirtualTourDTO>(`${this.base}/by-id/${tourId}`);
  }

  getTourPublic(propertyId: number): Observable<VirtualTourDTO> {
    return this.http.get<VirtualTourDTO>(`${this.base}/public/${propertyId}`);
  }

  getStatus(propertyId: number): Observable<VirtualTourDTO> {
    return this.http.get<VirtualTourDTO>(`${this.base}/status/${propertyId}`);
  }

  /** Poll processing status by tour ID — used for standalone tours. */
  getStatusById(tourId: number): Observable<VirtualTourDTO> {
    return this.http.get<VirtualTourDTO>(`${this.base}/status-by-id/${tourId}`);
  }

  deleteTour(propertyId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${propertyId}`);
  }
}
