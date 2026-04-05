export default function Home() {
  return (
    <div className="text-center py-20 px-4">
      <h1 className="text-5xl font-bold">Welcome to URide</h1>
      <p className="mt-4 text-lg text-gray-600">
        Fast, safe, and reliable rides for everyone.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <a href="/signup" className="px-6 py-3 bg-blue-600 text-white rounded-lg">
          Get Started
        </a>
        <a href="/driver/dashboard" className="px-6 py-3 bg-gray-800 text-white rounded-lg">
          Driver Portal
        </a>
      </div>
    </div>
  );
}
