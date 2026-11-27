import PhaseDWorkspace from './phase-d-workspace';
export default async function UploadDetail({params}:{params:Promise<{id:string}>}){return <PhaseDWorkspace uploadId={Number((await params).id)}/>}
