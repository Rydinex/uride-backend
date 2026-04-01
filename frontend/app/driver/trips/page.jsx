import ProtectedRoute from "../../../components/ProtectedRoute";

export default function DriverTripsPage() {
  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold">Driver Trips</h1>
        <p className="mt-3 text-gray-600">Review completed, canceled, and upcoming rides.</p>
      </div>
    </ProtectedRoute>
  );
}
