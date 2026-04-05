import ProtectedRoute from "../../../components/ProtectedRoute";

export default function DriverProfilePage() {
  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold">Driver Profile</h1>
        <p className="mt-3 text-gray-600">Manage personal details, vehicle info, and documents.</p>
      </div>
    </ProtectedRoute>
  );
}
