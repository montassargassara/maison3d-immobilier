import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType, HttpRequest } from '@angular/common/http';
import { Observable, filter, map } from 'rxjs';
import { apiBaseUrl } from '../../services/api-config';

export interface GaussianSplatDTO {
  id: number;
  propertyId: number | null;
  status:
    | 'NOT_CREATED'
    | 'PENDING'
    | 'PROCESSING'
    | 'AWAITING_VALIDATION'
    | 'ACCEPTED'
    | 'REJECTED'
    | 'COMPLETED'
    | 'FAILED';
  processingProgress: number;
  currentStep: string | null;
  errorMessage: string | null;
  iterations: number;
  sceneCount: number;
  plyUrl: string | null;
  /** True when status is AWAITING_VALIDATION and the preview file exists on disk. */
  previewAvailable: boolean;
  /** Format of the preview file: 'ply' | 'ksplat' | 'splat'. */
  previewFormat: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GaussianUploadProgress {
  type: 'progress' | 'done';
  percent?: number;
  splat?: GaussianSplatDTO;
}

@Injectable({ providedIn: 'root' })
export class GaussianSplatService {
  private readonly base = `${apiBaseUrl}/api/gaussian-splat`;

  constructor(private http: HttpClient) {}

  generateForProperty(propertyId: number, file: File, iterations = 7000): Observable<GaussianUploadProgress> {
    return this._upload(`${this.base}/generate/${propertyId}`, file, iterations);
  }

  generateStandalone(file: File, iterations = 7000): Observable<GaussianUploadProgress> {
    return this._upload(`${this.base}/generate-standalone`, file, iterations);
  }

  private _upload(url: string, file: File, iterations: number): Observable<GaussianUploadProgress> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('iterations', String(iterations));
    const req = new HttpRequest('POST', url, fd, { reportProgress: true });
    return this.http.request<GaussianSplatDTO>(req).pipe(
      filter(e => e.type === HttpEventType.UploadProgress || e.type === HttpEventType.Response),
      map(e => {
        if (e.type === HttpEventType.UploadProgress) {
          const percent = e.total ? Math.round((100 * e.loaded) / e.total) : 0;
          return { type: 'progress' as const, percent };
        }
        return { type: 'done' as const, splat: (e as any).body! };
      })
    );
  }

  getStatus(splatId: number): Observable<GaussianSplatDTO> {
    return this.http.get<GaussianSplatDTO>(`${this.base}/status/${splatId}`);
  }

  getStatusForProperty(propertyId: number): Observable<GaussianSplatDTO> {
    return this.http.get<GaussianSplatDTO>(`${this.base}/status-for-property/${propertyId}`);
  }

  /**
   * Fetch the preview file as a Blob (JWT is attached by the interceptor).
   * Use URL.createObjectURL() on the result and pass it to <app-splat-viewer>.
   */
  getPreviewBlob(splatId: number): Observable<Blob> {
    return this.http.get(`${this.base}/${splatId}/preview`, { responseType: 'blob' });
  }

  /** Accept the generated splat — returns the new Model3DDTO. */
  accept(splatId: number): Observable<any> {
    return this.http.post(`${this.base}/${splatId}/accept`, {});
  }

  /** Reject the generated splat — archives the work directory. */
  reject(splatId: number): Observable<any> {
    return this.http.post(`${this.base}/${splatId}/reject`, {});
  }
}
