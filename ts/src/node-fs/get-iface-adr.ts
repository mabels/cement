import { NetworkInterfaceInfo, networkInterfaces } from "node:os";

export function getInterfaceAddresses(): Record<string, NetworkInterfaceInfo[]> {
  const nets = networkInterfaces();
  return Array.from(Object.entries(nets))
    .filter((i) => i[1])
    .reduce(
      (acc, [name, nets]) => {
        if (nets) {
          // console.log(name, nets);
          acc[name] = nets; // as NetworkInterfaceInfo[];
        }
        return acc;
      },
      {} as Record<string, NetworkInterfaceInfo[]>,
    );
}
// for (const name of Object.keys(nets)) {
//     for (const net of nets[name]) {
//         // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
//         // 'IPv4' is in Node <= 17, from 18 it's a number 4 or 6
//         const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4
//         if (net.family === familyV4Value && !net.internal) {
//             if (!results[name]) {
//                 results[name] = [];
//             }
//             results[name].push(net.address);
//         }
//     }
// }

// console.log(getInterfaceAddresses());
