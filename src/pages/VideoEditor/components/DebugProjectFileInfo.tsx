import { useProjectFile } from "../hooks/useProjectFileManager";
import { useMemo } from "react";

export default function DebugProjectFileInfo() {
    const projectManager = useProjectFile();

    // Use the built-in serialization method with forced reactivity
    const serializedProject = useMemo(() => {
        return projectManager.getSerializedProject();
    }, [projectManager.project]);

    return (
        <div className="text-xs text-zinc-400">
            <div className="mb-2 font-semibold">Project Debug Info:</div>
            <pre className="whitespace-pre-wrap break-words">
                {JSON.stringify(serializedProject, null, 2)}
            </pre>
        </div>
    );
}