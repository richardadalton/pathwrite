import type { PathDefinition, PathData, PathEngine, PathSnapshot } from './index.svelte.js';
import type { Snippet } from 'svelte';
interface Props {
    path?: PathDefinition<any>;
    engine?: PathEngine;
    initialData?: PathData;
    autoStart?: boolean;
    backLabel?: string;
    nextLabel?: string;
    completeLabel?: string;
    cancelLabel?: string;
    hideCancel?: boolean;
    hideProgress?: boolean;
    oncomplete?: (data: PathData) => void;
    oncancel?: (data: PathData) => void;
    onevent?: (event: any) => void;
    header?: Snippet<[PathSnapshot<any>]>;
    footer?: Snippet<[PathSnapshot<any>, object]>;
    [key: string]: Snippet | any;
}
declare const PathShell: import("svelte").Component<Props, {}, "">;
type PathShell = ReturnType<typeof PathShell>;
export default PathShell;
//# sourceMappingURL=PathShell.svelte.d.ts.map