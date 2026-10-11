import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { GamesComponent } from './games';

describe('GamesComponent', () => {
  it('lets the player choose between the two games', async () => {
    await TestBed.configureTestingModule({ imports: [GamesComponent], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(GamesComponent);
    fixture.detectChanges();

    const cards = Array.from(fixture.nativeElement.querySelectorAll('.skill-card')) as HTMLAnchorElement[];
    expect(cards.map((card) => card.getAttribute('href'))).toEqual(['/pioggia-di-numeri', '/amici-del-10']);
  });
});
