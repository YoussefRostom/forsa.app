export type GlobalUploadProgressState = {
  visible: boolean;
  inProgress: boolean;
  progress: number;
  currentItem: number;
  totalItems: number;
  label: string;
};

type Listener = (state: GlobalUploadProgressState) => void;

const DEFAULT_STATE: GlobalUploadProgressState = {
  visible: false,
  inProgress: false,
  progress: 0,
  currentItem: 0,
  totalItems: 0,
  label: '',
};

let currentState: GlobalUploadProgressState = { ...DEFAULT_STATE };
let hideTimeout: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener(currentState));
}

function setState(next: Partial<GlobalUploadProgressState>) {
  currentState = { ...currentState, ...next };
  emit();
}

export function subscribeToUploadProgress(listener: Listener) {
  listeners.add(listener);
  listener(currentState);

  return () => {
    listeners.delete(listener);
  };
}

export function getUploadProgressState(): GlobalUploadProgressState {
  return currentState;
}

export function startGlobalUpload(totalItems: number, label?: string) {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  setState({
    visible: true,
    inProgress: true,
    progress: 0,
    currentItem: 1,
    totalItems: totalItems > 0 ? totalItems : 1,
    label: label || '',
  });
}

export function updateGlobalUploadProgress(progress: number, currentItem: number, totalItems: number, label?: string) {
  setState({
    visible: true,
    inProgress: true,
    progress: Math.max(0, Math.min(100, Math.round(progress))),
    currentItem: Math.max(1, currentItem),
    totalItems: Math.max(1, totalItems),
    label: label || currentState.label,
  });
}

export function finishGlobalUpload(successCount: number, failCount: number, label?: string) {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  const fallbackLabel = failCount > 0
    ? `${successCount} uploaded, ${failCount} failed`
    : 'Upload complete';

  setState({
    visible: true,
    inProgress: false,
    progress: 100,
    label: label || fallbackLabel,
  });

  hideTimeout = setTimeout(() => {
    setState({ ...DEFAULT_STATE });
    hideTimeout = null;
  }, 4000);
}

export function failGlobalUpload(message?: string) {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  setState({
    visible: true,
    inProgress: false,
    progress: 0,
    label: message || 'Upload failed',
  });

  hideTimeout = setTimeout(() => {
    setState({ ...DEFAULT_STATE });
    hideTimeout = null;
  }, 5000);
}
