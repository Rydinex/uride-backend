import ProtectedRoute from "../../../components/ProtectedRoute";

export default function RiderBookPage() {
  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold">Book a Ride</h1>
        <p className="mt-3 text-gray-600">Set pickup, destination, and choose your ride type.</p>
      </div>
    </ProtectedRoute>
  );
}
