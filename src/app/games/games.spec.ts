import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { FactStats } from '../review/fact-stats';
import { GamesComponent } from './games';

describe('GamesComponent', () => {
  let fixture: ComponentFixture<GamesComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [GamesComponent], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(GamesComponent);
    fixture.detectChanges();
  });

  function links(selector: string): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll(selector) as NodeListOf<HTMLAnchorElement>).map((card) => card.getAttribute('href')!);
  }

  it('lets the player choose between the games', () => {
    expect(links('.skill-card')).toEqual([
      '/tabelline', '/griglia-a-buchi', '/fattore-mancante', '/battaglia-navale', '/ripasso',
      '/pioggia-di-numeri', '/amici-del-10', '/sottrazione-bersaglio', '/prodotto-bersaglio', '/caccia-ai-multipli', '/conta-gli-zeri', '/divisione-bersaglio',
    ]);
  });

  it('highlights the games of the review path and which ones are done', () => {
    expect(links('.review-path .skill-card--review')).toEqual(['/tabelline', '/griglia-a-buchi', '/fattore-mancante', '/battaglia-navale']);
    expect(fixture.nativeElement.querySelector('.skill-card--final').textContent).toContain('Mancano 4');

    TestBed.inject(FactStats).markPlayed('grid');
    fixture.detectChanges();
    expect(links('.skill-card--done')).toEqual(['/griglia-a-buchi']);
    expect(fixture.nativeElement.querySelector('.skill-card--final').textContent).toContain('Mancano 3');
  });

  it('unlocks the final review when every game of the path is done', () => {
    const stats = TestBed.inject(FactStats);
    (['tables', 'grid', 'missing', 'battleship'] as const).forEach((id) => stats.markPlayed(id));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.skill-card--locked')).toBeNull();
    expect(fixture.nativeElement.querySelector('.skill-card--final').textContent).toContain('Sbloccato');
  });
});
