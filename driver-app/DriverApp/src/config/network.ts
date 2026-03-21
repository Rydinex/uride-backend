import { NativeModules, Platform } from 'react-native';

// Optional manual override for local physical-device testing on the same LAN.
const MANUAL_BACKEND_HOST = '10.0.0.70';
const resolveDevBackendHost = () => {
    const manualHost = MANUAL_BACKEND_HOST.trim();
    if (manualHost) {
        return manualHost;
    }

    // On physical devices, Metro scriptURL usually contains the host machine LAN IP.
    const scriptURL = (NativeModules as { SourceCode?: { scriptURL?: string } }).SourceCode?.scriptURL || '';
    const scriptHostMatch = scriptURL.match(/^https?:\/\/([^/:]+)/i);
    const scriptHost = scriptHostMatch?.[1]?.trim();

    if (scriptHost && scriptHost !== 'localhost' && scriptHost !== '127.0.0.1') {
        return scriptHost;
    }

    return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
};

const DEV_BACKEND_HOST = resolveDevBackendHost();
const DEV_BACKEND_URL = `http://${DEV_BACKEND_HOST}:4000`;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const BACKEND_URL = trimTrailingSlash(DEV_BACKEND_URL);
export const API_BASE_URL = `${BACKEND_URL}/api`;
export const SOCKET_URL = BACKEND_URL;