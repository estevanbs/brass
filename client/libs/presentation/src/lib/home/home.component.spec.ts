import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  it('offers an offline and an online mode, linking to /offline and /online', async () => {
    await TestBed.configureTestingModule({ providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const links = Array.from(el.querySelectorAll('a'));
    expect(links.map((a) => a.getAttribute('routerLink'))).toEqual(['/offline', '/online']);
    expect(el.textContent).toContain('Jogar offline');
    expect(el.textContent).toContain('Jogar online');
  });
});
