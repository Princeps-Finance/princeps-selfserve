import { CameraSession } from './camera-session';

it('closes a stream that arrives after leaving the camera screen', async () => {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  const camera = new CameraSession();
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  let grantCameraPermission!: (value: MediaStream) => void;

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: () =>
        new Promise<MediaStream>((resolve) => {
          grantCameraPermission = resolve;
        }),
    },
  });

  try {
    const request = camera.open(true);
    camera.close();
    grantCameraPermission(stream);
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(stop).toHaveBeenCalledOnce();
  } finally {
    if (previous) Object.defineProperty(navigator, 'mediaDevices', previous);
    else Reflect.deleteProperty(navigator, 'mediaDevices');
  }
});
