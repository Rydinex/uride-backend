import ProtectedRoute from "../../../components/ProtectedRoute";

export default function RiderHistoryPage() {
  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold">Ride History</h1>
        <p className="mt-3 text-gray-600">View previous rides, receipts, and ratings.</p>
      </div>
    </ProtectedRoute>
  );
}
