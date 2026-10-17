import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type Skill = {
  name: string;
  description: string;
  symbol: string;
  route: string;
  /** Etichetta in alto a destra (es. per le abilita' del percorso tabelline). */
  badge?: string;
};

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  protected readonly skills: Skill[] = [
    { name: 'Tabelline', description: 'Impara a moltiplicare con sicurezza', symbol: 'x', route: '/tabelline', badge: '🧠 Percorso tabelline' },
    { name: 'Addizione', description: 'Metti insieme i numeri', symbol: '+', route: '/addizione' },
    { name: 'Sottrazione', description: 'Scopri quanto rimane', symbol: '-', route: '/sottrazione' },
    { name: 'Moltiplicazione', description: 'Raggruppa e calcola', symbol: '·', route: '/moltiplicazione' },
    { name: 'Divisione', description: 'Distribuisci in parti uguali', symbol: '÷', route: '/divisione' },
    { name: 'Giochi', description: 'Il percorso tabelline con Battaglia navale e Ripasso finale, Pioggia di numeri e i giochi con il bersaglio', symbol: '🎮', route: '/giochi' },
  ];
}
