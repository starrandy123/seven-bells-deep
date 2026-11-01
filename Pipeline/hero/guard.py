# A job's own limits, on a shared 8 GB machine that has panicked on swap. Imported first by every Blender script here: the job prints its own stack to a
# file every few seconds (so a stall names its line) and ends itself if swap grows past its allowance or it runs past its time. It only ever exits itself.
import faulthandler, os, re, subprocess, threading, time

def swap_mb():
    s = subprocess.run(['sysctl', '-n', 'vm.swapusage'], capture_output=True, text=True).stdout
    return float(re.search(r'used = ([0-9.]+)M', s).group(1))

def start(log_path, seconds=170, grow_mb=1800, every=15):
    f = open(log_path, 'w', buffering=1)
    faulthandler.dump_traceback_later(every, repeat=True, file=f)
    base = swap_mb(); t0 = time.time()
    f.write('guard: swap at start %.0f MB, limit +%d MB, %d s\n' % (base, grow_mb, seconds))
    def watch():
        while True:
            time.sleep(1.5)
            now = swap_mb(); el = time.time() - t0
            if now - base > grow_mb or el > seconds:
                f.write('GUARD STOPPED THE JOB: swap %.0f MB (start %.0f), %.0f s\n' % (now, base, el))
                faulthandler.dump_traceback(file=f); f.flush()
                print('GUARD STOPPED THE JOB: swap %.0f MB (start %.0f), %.0f s' % (now, base, el), flush=True)
                os._exit(3)
    threading.Thread(target=watch, daemon=True).start()
