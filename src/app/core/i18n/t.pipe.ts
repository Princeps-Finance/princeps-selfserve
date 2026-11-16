import { Pipe, PipeTransform, inject } from '@angular/core';
import { LangService } from './lang.service';

@Pipe({ name: 't', pure: false })
export class TPipe implements PipeTransform {
  private readonly lang = inject(LangService);

  transform(key: string, params?: Record<string, string | number>): string {
    // Read the signal so the pipe re-renders when the language changes.
    this.lang.lang();
    const raw = this.lang.t(key);
    if (!params) return raw;
    return raw.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
      params[name] !== undefined ? String(params[name]) : `{${name}}`,
    );
  }
}
