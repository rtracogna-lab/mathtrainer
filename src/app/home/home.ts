import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type Skill = {
  name: string;
  description: string;
  symbol: string;
  route: string;
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
    { name: 'Tabelline', description: 'Impara a moltiplicare con sicurezza', symbol: 'x', route: '/tabelline' },
    { name: 'Addizione', description: 'Metti insieme i numeri', symbol: '+', route: '/addizione' },
    { name: 'Sottrazione', description: 'Scopri quanto rimane', symbol: '-', route: '/sottrazione' },
    { name: 'Moltiplicazione', description: 'Raggruppa e calcola', symbol: '·', route: '/moltiplicazione' },
    { name: 'Divisione', description: 'Distribuisci in parti uguali', symbol: '÷', route: '/divisione' },
  ];
}
