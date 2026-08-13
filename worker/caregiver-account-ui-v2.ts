import {routeCaregiverAccountUiV2 as routeAccountUi} from "./caregiver-account-ui-v2-hotfix";
import {routeCaregiverProfileCredentialsV2} from "./caregiver-profile-credentials-v2";
import {type Env} from "./lib";

export function routeCaregiverAccountUiV2(request:Request,env:Env):Response|Promise<Response>|null{
 const url=new URL(request.url);
 if(url.pathname==="/api/caregiver/platform/profile/credentials"&&request.method.toUpperCase()==="POST")return routeCaregiverProfileCredentialsV2(request,env);
 return routeAccountUi(request,env);
}
