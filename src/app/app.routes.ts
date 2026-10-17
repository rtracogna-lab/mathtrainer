import { Routes } from '@angular/router';
import { HomeComponent } from './home/home';
import { AdditionComponent } from './skills/addition/addition';
import { SubtractionComponent } from './skills/subtraction/subtraction';
import { MultiplicationComponent } from './skills/multiplication/multiplication';
import { DivisionComponent } from './skills/division/division';
import { TablesComponent } from './skills/tables/tables';
import { NumberRainComponent } from './games/number-rain/number-rain';
import { GamesComponent } from './games/games';
import { HoleGridComponent } from './games/hole-grid/hole-grid';
import { BattleshipComponent } from './games/battleship/battleship';
import { ReviewComponent } from './review/review';

export const routes: Routes = [
	{ path: '', component: HomeComponent, title: 'Allenamento di matematica' },
	{ path: 'tabelline', component: TablesComponent, title: 'Tabelline' },
	{ path: 'addizione', component: AdditionComponent, title: 'Addizione' },
	{ path: 'sottrazione', component: SubtractionComponent, title: 'Sottrazione' },
	{ path: 'moltiplicazione', component: MultiplicationComponent, title: 'Moltiplicazione' },
	{ path: 'divisione', component: DivisionComponent, title: 'Divisione' },
	{ path: 'giochi', component: GamesComponent, title: 'Giochi' },
	{ path: 'pioggia-di-numeri', component: NumberRainComponent, title: 'Pioggia di numeri', data: { variant: 'rain' } },
	{ path: 'amici-del-10', component: NumberRainComponent, title: 'Amici del 10', data: { variant: 'friends' } },
	{ path: 'prodotto-bersaglio', component: NumberRainComponent, title: 'Prodotto bersaglio', data: { variant: 'product' } },
	{ path: 'sottrazione-bersaglio', component: NumberRainComponent, title: 'Sottrazione bersaglio', data: { variant: 'subtraction' } },
	{ path: 'caccia-ai-multipli', component: NumberRainComponent, title: 'Caccia ai multipli', data: { variant: 'multiples' } },
	{ path: 'conta-gli-zeri', component: NumberRainComponent, title: 'Conta gli zeri', data: { variant: 'zeros' } },
	{ path: 'divisione-bersaglio', component: NumberRainComponent, title: 'Divisione bersaglio', data: { variant: 'division' } },
	{ path: 'fattore-mancante', component: NumberRainComponent, title: 'Fattore mancante', data: { variant: 'missing' } },
	{ path: 'griglia-a-buchi', component: HoleGridComponent, title: 'La griglia a buchi' },
	{ path: 'battaglia-navale', component: BattleshipComponent, title: 'Battaglia navale' },
	{ path: 'ripasso', component: ReviewComponent, title: 'Ripasso finale' },
	{ path: '**', redirectTo: '' },
];
