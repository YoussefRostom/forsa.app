export interface UserData {
    id: string;
    name: string;
    email: string;
    role: 'player' | 'provider' | 'admin';
    status: 'active' | 'pending' | 'suspended';
}

export interface BookingData {
    id: string;
    playerName: string;
    providerName: string;
    service: string;
    date: string;
    status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
}

export interface CheckInData {
    id: string;
    playerName: string;
    providerName: string;
    userCode: string;
    date: string;
    commission: number;
    status: 'verified' | 'pending';
}

export const mockApi = {
    getStats: async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return {
            totalUsers: 1250,
            totalBookings: 450,
            totalCheckIns: 320,
            totalCommission: 15400,
        };
    },

    getUsers: async (page = 1) => {
        await new Promise(resolve => setTimeout(resolve, 800));
        return [
            { id: '1', name: 'John Doe', email: 'john@example.com', role: 'player', status: 'active' },
            { id: '2', name: 'Elite Academy', email: 'info@elite.com', role: 'provider', status: 'pending' },
            { id: '3', name: 'Jane Smith', email: 'jane@example.com', role: 'player', status: 'suspended' },
        ] as UserData[];
    },

    getBookings: async () => {
        await new Promise(resolve => setTimeout(resolve, 800));
        return [
            { id: '101', playerName: 'John Doe', providerName: 'Elite Academy', service: 'Soccer Training', date: '2024-02-15', status: 'confirmed' },
            { id: '102', playerName: 'Alice Brown', providerName: 'Pro Tennis', service: 'Private Lesson', date: '2024-02-16', status: 'pending' },
        ] as BookingData[];
    },

    getCheckIns: async () => {
        await new Promise(resolve => setTimeout(resolve, 800));
        return [
            { id: '201', playerName: 'John Doe', providerName: 'Elite Academy', userCode: 'FORSA-X92', date: '2024-02-15', commission: 15, status: 'verified' },
        ] as CheckInData[];
    },

    getNotifications: async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return [
            { id: '1', title: 'New Booking', message: 'John Doe booked Soccer Training', time: '2 mins ago', type: 'booking' },
            { id: '2', title: 'Check-in Registered', message: 'Alice Brown checked in at Pro Tennis', time: '1 hour ago', type: 'checkin' },
        ];
    }
};
