import ProtectedRoute from "../../../components/ProtectedRoute";

export default function DriverEarningsPage() {
  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold">Driver Earnings</h1>
        <p className="mt-3 text-gray-600">Track daily, weekly, and monthly earnings.</p>
      </div>
    </ProtectedRoute>
  );
}
