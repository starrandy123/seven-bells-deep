# Tiles the four views of each animal into one image, to look at them together.
import os, sys
import cv2
import numpy as np
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'preview')
for name in sys.argv[1:]:
    ims = [cv2.imread(os.path.join(P, 'animal_%s_%s.png' % (name, v))) for v in ('side', 'q', 'top', 'low')]
    if any(i is None for i in ims):
        continue
    cv2.imwrite(os.path.join(P, 'animal_%s.png' % name), np.vstack([np.hstack(ims[:2]), np.hstack(ims[2:])]))
    for v in ('side', 'q', 'top', 'low'):
        os.remove(os.path.join(P, 'animal_%s_%s.png' % (name, v)))
