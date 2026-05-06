import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./home/home.module').then( m => m.HomePageModule),
    canActivate: [AuthGuard]
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadChildren: () => import('./login/login.module').then( m => m.LoginPageModule)
  },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module').then( m => m.AdminPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'register',
    loadChildren: () => import('./register/register.module').then( m => m.RegisterPageModule)
  },
  {
    path: 'profile',
    loadChildren: () => import('./profile/profile.module').then( m => m.ProfilePageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'department',
    loadChildren: () => import('./department/department.module').then( m => m.DepartmentPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'network',
    loadChildren: () => import('./network/network.module').then( m => m.NetworkPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'history',
    loadChildren: () => import('./history/history.module').then( m => m.HistoryPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'feeds',
    loadChildren: () => import('./feeds/feeds.module').then( m => m.FeedsPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'messages',
    loadChildren: () => import('./messages/messages.module').then( m => m.MessagesPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'notifications',
    loadChildren: () => import('./notifications/notifications.module').then( m => m.NotificationsPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'qr-scanner',
    loadChildren: () => import('./qr-scanner/qr-scanner.module').then( m => m.QrScannerPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'user-profile/:uid',
    loadChildren: () => import('./user-profile/user-profile.module').then( m => m.UserProfilePageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'chat/:uid',
    loadChildren: () => import('./chat/chat.module').then( m => m.ChatPageModule),
    canActivate: [AuthGuard]
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
