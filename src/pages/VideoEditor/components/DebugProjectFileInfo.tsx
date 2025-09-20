import { useEffect, useState } from "react";
import { getProject, loadProject, saveProject, updateProject } from "../../../lib/projectFile";

export default function DebugProjectFileInfo() {
    const [projectFile, setProjectFile] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            const data = await getProject();
            setProjectFile(data);
        };
        fetchData();
    }, []);

    return (
        <div className="rounded border border-zinc-800 p-2">
            <div className="text-xs mb-2 text-zinc-400">Project File Info</div>
            <div className="text-xs text-zinc-400">
                <pre>{JSON.stringify(projectFile, null, 2)}</pre>
            </div>
        </div>
    );
}