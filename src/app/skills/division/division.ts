import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({ selector: 'app-division', imports: [RouterLink], templateUrl: '../skill-page.html', styleUrl: '../skill-page.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class DivisionComponent { protected readonly skill = { name: 'Divisione', symbol: '÷', color: '#d4c2f3' }; }
