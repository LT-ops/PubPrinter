import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

interface TokenPriceChartProps {
  data: Array<{
    timestamp: number;
    price: number;
  }>;
  color: string;
}

export function TokenPriceChart({ data, color }: TokenPriceChartProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className="h-32 mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={['auto', 'auto']}
            tickFormatter={(unixTime) => {
              return new Date(unixTime * 1000).toLocaleDateString();
            }}
            stroke="#666"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="number"
            domain={[
              (dataMin: number) => Math.max(0, dataMin * 0.95),
              (dataMax: number) => dataMax * 1.05
            ]}
            stroke="#666"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${Number(value).toFixed(6)}`}
          />
          <RechartsTooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const price = payload[0].value;
                const date = new Date(label * 1000);
                return (
                  <div className="bg-white p-2 border border-gray-200 shadow rounded">
                    <p className="text-xs text-gray-600">
                      {date.toLocaleDateString()}
                    </p>
                    <p className="text-xs font-bold text-black">
                      ${Number(price).toFixed(6)}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke={color}
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
