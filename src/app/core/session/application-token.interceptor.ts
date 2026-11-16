import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError, takeUntil } from 'rxjs';
import { apiOrigin } from '../api-origin';
import { ApplicationSession } from './application-session.service';
export const applicationTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(ApplicationSession);
  const applicationId = session.applicationId();
  if (!applicationId)
    return next(request.clone({ headers: request.headers.delete('x-application-resume-token') }));
  const base = apiOrigin() + '/api/v2/applications/' + encodeURIComponent(applicationId);
  if (request.url !== base && !request.url.startsWith(base + '/'))
    return next(request.clone({ headers: request.headers.delete('x-application-resume-token') }));
  const token = session.tokenFor(applicationId);
  const generation = session.generation();
  return next(
    request.clone({
      redirect: 'error',
      credentials: 'omit',
      setHeaders: token ? { 'x-application-resume-token': token } : {},
    }),
  ).pipe(
    takeUntil(session.cancelled),
    catchError((error) => {
      const code = error.error?.code;
      if (
        session.generation() === generation &&
        (error.status === 401 || code === 'RESUME_TOKEN_REQUIRED' || code === 'APPLICATION_CLOSED')
      )
        session.reset();
      return throwError(() => error);
    }),
  );
};
