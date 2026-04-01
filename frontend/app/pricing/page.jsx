export default function PricingPage() {
  return (
    <div className="max-w-4xl mx-auto py-16 px-4">
      <h1 className="text-4xl font-bold">Pricing</h1>
      <p className="mt-4 text-gray-700">Transparent pricing with no hidden fees.</p>
      <div className="mt-8 grid md:grid-cols-3 gap-4">
        <div className="border rounded-xl p-5 bg-white">
          <h2 className="font-semibold text-xl">Economy</h2>
          <p className="text-gray-600 mt-2">Best for daily rides.</p>
        </div>
        <div className="border rounded-xl p-5 bg-white">
          <h2 className="font-semibold text-xl">Comfort</h2>
          <p className="text-gray-600 mt-2">Extra legroom and newer vehicles.</p>
        </div>
        <div className="border rounded-xl p-5 bg-white">
          <h2 className="font-semibold text-xl">Black</h2>
          <p className="text-gray-600 mt-2">Premium rides for special occasions.</p>
        </div>
      </div>
    </div>
  );
}
