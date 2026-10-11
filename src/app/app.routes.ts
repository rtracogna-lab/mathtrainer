import { Routes } from '@angular/router';
import { HomeComponent } from './home/home';
import { AdditionComponent } from './skills/addition/addition';
import { SubtractionComponent } from './skills/subtraction/subtraction';
import { MultiplicationComponent } from './skills/multiplication/multiplication';
import { DivisionComponent } from './skills/division/division';
import { TablesComponent } from './skills/tables/tables';

export const routes: Routes = [
	{ path: '', component: HomeComponent, title: 'Allenamento di matematica' },
	{ path: 'tabelline', component: TablesComponent, title: 'Tabelline' },
	{ path: 'addizione', component: AdditionComponent, title: 'Addizione' },
	{ path: 'sottrazione', component: SubtractionComponent, title: 'Sottrazione' },
	{ path: 'moltiplicazione', component: MultiplicationComponent, title: 'Moltiplicazione' },
	{ path: 'divisione', component: DivisionComponent, title: 'Divisione' },
	{ path: '**', redirectTo: '' },
];
