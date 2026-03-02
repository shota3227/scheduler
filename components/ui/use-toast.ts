import * as React from "react";

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = {
    id: string;
    title?: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactNode;
    open?: boolean;
};

let count = 0;
function genId() {
    count = (count + 1) % Number.MAX_SAFE_INTEGER;
    return count.toString();
}

type State = { toasts: ToasterToast[] };

const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

function dispatch(action: { type: string; toast?: ToasterToast; toastId?: string }) {
    memoryState = reducer(memoryState, action);
    listeners.forEach((listener) => listener(memoryState));
}

function reducer(state: State, action: { type: string; toast?: ToasterToast; toastId?: string }): State {
    switch (action.type) {
        case "ADD_TOAST":
            return { ...state, toasts: [action.toast!, ...state.toasts].slice(0, TOAST_LIMIT) };
        case "DISMISS_TOAST":
            return { ...state, toasts: state.toasts.map((t) => t.id === action.toastId ? { ...t, open: false } : t) };
        case "REMOVE_TOAST":
            return { ...state, toasts: state.toasts.filter((t) => t.id !== action.toastId) };
        default:
            return state;
    }
}

function toast(props: Omit<ToasterToast, "id">) {
    const id = genId();
    dispatch({ type: "ADD_TOAST", toast: { ...props, id, open: true } });
    setTimeout(() => dispatch({ type: "DISMISS_TOAST", toastId: id }), 5000);
    setTimeout(() => dispatch({ type: "REMOVE_TOAST", toastId: id }), 5000 + TOAST_REMOVE_DELAY);
    return { id, dismiss: () => dispatch({ type: "DISMISS_TOAST", toastId: id }) };
}

function useToast() {
    const [state, setState] = React.useState<State>(memoryState);
    React.useEffect(() => {
        listeners.push(setState);
        return () => {
            const index = listeners.indexOf(setState);
            if (index > -1) listeners.splice(index, 1);
        };
    }, [state]);
    return { ...state, toast, dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }) };
}

export { useToast, toast };
