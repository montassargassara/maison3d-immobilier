import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType, HttpRequest } from '@angular/common/http';
import { Observable, filter, map } from 'rxjs';
import { apiBaseUrl } from '../../services/api-config';

export interface MapAnythingJobDTO {
  id: number;
  propertyId: number | null;
  /** PENDING | PROCESSING | AWAITING_VALIDATION | ACCEPTED | REJECTED | FAILED */
  status: 'NOT_CREATED' | 'PENDING' | 'PROCESSING' | 'AWAITING_VALIDATION' | 'ACCEPTED' | 'REJECTED' | 'FAILED';
  processingProgress: number;
  currentStep: string | null;
  errorMessage: string | null;
  /** True when the temp GLB is ready for admin preview (AWAITING_VALIDATION or ACCEPTED). */
  glbAvailable: boolean;
  /** Permanent public URL — only set after ACCEPTED. */
  glbUrl: string | null;
  model3dId: number | null;
  // Stats populated at AWAITING_VALIDATION
  glbFileSize: number | null;
  vertexCount: number | null;
  meshCount: number | null;
  generationTimeMs: number | null;
  createdAt: string;
  updatedAt: string;
}

export type MapAnythingUploadEvent =
  | { type: 'progress'; percent: number }
  | { type: 'done'; job: MapAnythingJobDTO };

@Injectable({ providedIn: 'root' })
export class MapAnythingService {
  private readonly base = `${apiBaseUrl}/api/mapanything`;

  constructor(private http: HttpClient) {}

  start(propertyId: number, file: File): Observable<MapAnythingUploadEvent> {
    const fd = new FormData();
    fd.append('file', file);
    const req = new HttpRequest('POST', `${this.base}/property/${propertyId}/start`, fd, {
      reportProgress: true,
    });
    return this.http.request<MapAnythingJobDTO>(req).pipe(
      filter(
        e => e.type === HttpEventType.UploadProgress || e.type === HttpEventType.Response,
      ),
      map(e => {
        if (e.type === HttpEventType.UploadProgress) {
          const percent = e.total ? Math.round((100 * e.loaded) / e.total) : 0;
          return { type: 'progress' as const, percent };
        }
        return { type: 'done' as const, job: (e as any).body! };
      }),
    );
  }

  getStatus(propertyId: number): Observable<MapAnythingJobDTO> {
    return this.http.get<MapAnythingJobDTO>(`${this.base}/property/${propertyId}`);
  }

  /** Fetch the temp GLB as a Blob for admin preview (JWT sent by interceptor). */
  getPreviewBlob(jobId: number): Observable<Blob> {
    return this.http.get(`${this.base}/${jobId}/preview`, { responseType: 'blob' });
  }

  /**
   * Accept: copy GLB to permanent storage, create Model3D, link to property.
   * Returns the updated DTO with glbUrl set.
   */
  accept(jobId: number): Observable<MapAnythingJobDTO> {
    return this.http.post<MapAnythingJobDTO>(`${this.base}/${jobId}/accept`, {});
  }

  /**
   * Reject: delete temp GLB + work dir, set REJECTED.
   * Returns the updated DTO (status = REJECTED).
   */
  reject(jobId: number): Observable<MapAnythingJobDTO> {
    return this.http.post<MapAnythingJobDTO>(`${this.base}/${jobId}/reject`, {});
  }
}
