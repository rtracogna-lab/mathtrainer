import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FactStats, REVIEW_GAMES } from '../review/fact-stats';

type Game = {
  name: string;
  description: string;
  symbol: string;
  route: string;
};

@Component({
  selector: 'app-games',
  imports: [RouterLink],
  templateUrl: './games.html',
  styleUrl: '../home/home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GamesComponent {
  protected readonly factStats = inject(FactStats);
  /** Giochi che preparano il ripasso finale (tabelline). */
  protected readonly reviewGames = REVIEW_GAMES;
  protected readonly games: Game[] = [
    { name: 'Pioggia di numeri', description: 'Abbina numeri da 1 a 99 che fanno 10, 20, 30…', symbol: '10', route: '/pioggia-di-numeri' },
    { name: 'Amici del 10', description: 'Abbina numeri da 1 a 9 che fanno esattamente 10', symbol: '🤝', route: '/amici-del-10' },
    { name: 'Sottrazione bersaglio', description: 'Trova i numeri la cui differenza fa il bersaglio', symbol: '−', route: '/sottrazione-bersaglio' },
    { name: 'Prodotto bersaglio', description: 'Trova i numeri che moltiplicati fanno il bersaglio', symbol: '×', route: '/prodotto-bersaglio' },
    { name: 'Caccia ai multipli', description: 'Tocca solo i multipli della tabellina', symbol: '🎯', route: '/caccia-ai-multipli' },
    { name: 'Conta gli zeri', description: 'Trova il risultato di 60 × 2 o 600 : 3 senza perdere gli zeri', symbol: '0', route: '/conta-gli-zeri' },
    { name: 'Divisione bersaglio', description: 'Trova dividendo e divisore che fanno il bersaglio', symbol: ':', route: '/divisione-bersaglio' },
  ];
}
