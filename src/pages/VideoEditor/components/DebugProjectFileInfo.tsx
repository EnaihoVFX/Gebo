import useProjectFileStore from "../../../stores/projectFileStore";

export default function DebugProjectFileInfo() {
    const projectFile = useProjectFileStore(state => state.projectFile);
    const path = useProjectFileStore(state => state.path);

    return (
        <div className="rounded border border-zinc-800 p-2">
            <div className="text-xs mb-2 text-zinc-400">Project File Info</div>
            <div className="text-xs text-zinc-400">
                <pre>{JSON.stringify(projectFile, null, 2)}</pre>
            </div>
            <div className="text-xs text-zinc-400 mt-2">Path: {path}</div>
        </div>
    );
}