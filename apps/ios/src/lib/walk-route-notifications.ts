import * as Notifications from 'expo-notifications';
import { t } from './i18n';
export async function requestWalkReminderPermission():Promise<void>{
 await Notifications.requestPermissionsAsync().catch(()=>{});
}
export async function showWalkReturnReminder(uid:string,walkId:string,isActive:()=>boolean):Promise<void>{
 const permission=await Notifications.getPermissionsAsync();
 if(!permission.granted || !isActive())return;
 await Notifications.scheduleNotificationAsync({identifier:`walk-return-${walkId}`,content:{title:t('WalkRecorder.returnTitle'),body:t('WalkRecorder.returnBody'),data:{kind:'walk-return',uid,walkId}},trigger:null});
 if(!isActive())await clearWalkReturnReminder(walkId);
}
export async function clearWalkReturnReminder(walkId:string):Promise<void>{
 await Notifications.cancelScheduledNotificationAsync(`walk-return-${walkId}`).catch(()=>{});
 await Notifications.dismissNotificationAsync(`walk-return-${walkId}`).catch(()=>{});
}
export function listenWalkReminderOpen(open:(uid:string,walkId:string)=>void):()=>void{
 const accept=(response:Notifications.NotificationResponse|null)=>{
  const data=response?.notification.request.content.data;
  if(data?.kind==='walk-return' && typeof data.uid==='string' && typeof data.walkId==='string'){
   open(data.uid,data.walkId);void Notifications.clearLastNotificationResponseAsync();
  }
 };
 const sub=Notifications.addNotificationResponseReceivedListener(accept);
 void Notifications.getLastNotificationResponseAsync().then(accept).catch(()=>{});
 return ()=>sub.remove();
}
