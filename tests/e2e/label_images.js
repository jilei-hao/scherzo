// Synthetic label maps for the end-to-end tests.

// Label data for an n^3 volume per time point: label 1 is a sphere, label 2 a
// box. `labelsAt(tp)` lists the labels drawn at each time point.
export function makeLabelData(n, numTimePoints = 1, labelsAt = () => [1, 2]) {
  const numVoxels = n * n * n;
  const data = new Array(numVoxels * numTimePoints).fill(0);
  const c = n / 2;

  for (let tp = 0; tp < numTimePoints; tp++) {
    const labels = labelsAt(tp);
    for (let z = 0; z < n; z++)
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const i = tp * numVoxels + x + n * (y + n * z);
          if (labels.includes(1) && Math.hypot(x - c / 2, y - c, z - c) < n / 6)
            data[i] = 1;
          else if (labels.includes(2) && x > c + 2 && x < n - 3 && Math.abs(y - c) < n / 6 && Math.abs(z - c) < n / 6)
            data[i] = 2;
        }
  }
  return data;
}

const NIFTI_TYPES = {
  uint8: { code: 2, bitpix: 8, write: 'writeUInt8' },
  int16: { code: 4, bitpix: 16, write: 'writeInt16LE' },
  uint16: { code: 512, bitpix: 16, write: 'writeUInt16LE' },
};

// Minimal single-file NIfTI-1 (.nii) with an identity qform.
export function makeNifti({ n, numTimePoints = 1, pixelType, data }) {
  const { code, bitpix, write } = NIFTI_TYPES[pixelType];
  const voxOffset = 352; // 348-byte header + 4-byte extension flag
  const buffer = Buffer.alloc(voxOffset + data.length * (bitpix / 8));

  buffer.writeInt32LE(348, 0); // sizeof_hdr
  const dim = numTimePoints > 1 ? [4, n, n, n, numTimePoints, 1, 1, 1] : [3, n, n, n, 1, 1, 1, 1];
  dim.forEach((d, i) => buffer.writeInt16LE(d, 40 + 2 * i));
  buffer.writeInt16LE(code, 70); // datatype
  buffer.writeInt16LE(bitpix, 72);
  [1, 1, 1, 1, 1, 0, 0, 0].forEach((p, i) => buffer.writeFloatLE(p, 76 + 4 * i)); // pixdim, qfac = 1
  buffer.writeFloatLE(voxOffset, 108);
  buffer.writeUInt8(2 | 8, 123); // xyzt_units: mm, s
  buffer.writeInt16LE(1, 252); // qform_code: scanner
  buffer.write('n+1\0', 344, 'latin1');

  data.forEach((value, i) => buffer[write](value, voxOffset + i * (bitpix / 8)));
  return buffer;
}
