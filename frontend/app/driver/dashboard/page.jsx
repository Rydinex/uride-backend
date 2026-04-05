import ProtectedRoute from "../../../components/ProtectedRoute";

export default function DriverDashboard() {
  return (
    <ProtectedRoute>
      <div className="p-10">
        <h1 className="text-4xl font-bold">Driver Dashboard</h1>
        <p className="mt-4 text-gray-600">View your trips, earnings, and more.</p>
      </div>
    </ProtectedRoute>
  );
}
