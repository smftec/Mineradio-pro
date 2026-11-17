# 通过 GitHub Git Data API 推送(github.com:443 被断时走 api.github.com)
import base64, json, subprocess, sys, tempfile, os

REPO = 'smftec/Mineradio-pro'

def gh(endpoint, method='GET', body=None):
    cmd = ['gh', 'api', f'repos/{REPO}/{endpoint}']
    if method != 'GET':
        cmd += ['-X', method]
    if body is not None:
        fp = os.path.join(tempfile.gettempdir(), f'gh-body-{abs(hash(endpoint))}.json')
        with open(fp, 'w', encoding='utf-8') as f:
            json.dump(body, f, ensure_ascii=False)
        cmd += ['--input', fp]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        raise RuntimeError(f'gh api {endpoint}: {r.stderr[:300]}')
    return json.loads(r.stdout) if r.stdout.strip() else None

base = gh('commits/main')
base_sha = base['sha']
base_tree = base['commit']['tree']['sha']
print('base:', base_sha[:7])

diff = subprocess.run(['git', 'diff', '--name-status', base_sha[:7], 'HEAD'],
                      capture_output=True, text=True, encoding='utf-8').stdout
entries = []
for line in diff.strip().splitlines():
    status, path = line.split('\t', 1)
    path = path.strip()
    if status.startswith('D'):
        entries.append({'path': path, 'mode': '100644', 'type': 'commit', 'sha': None})
        continue
    content = open(path, 'rb').read()
    blob = gh('git/blobs', 'POST', body={'content': base64.b64encode(content).decode(), 'encoding': 'base64'})
    entries.append({'path': path, 'mode': '100644', 'type': 'blob', 'sha': blob['sha']})
print('files changed:', len(entries))

tree = gh('git/trees', 'POST', body={'base_tree': base_tree, 'tree': entries})
print('tree:', tree['sha'][:7])

msg = """v2.3.0 可视化引擎 + 唱片墙 + 视频导出

- 可视化引擎(自研 Canvas2D):频谱粒子/环形频谱/波形流动,主题色联动
- 唱片墙:CSS 3D 封面墙(透视 + hover 抬升)
- 视频导出:WebM(VP9+Opus)可视化+逐字歌词+封面,保存到下载目录
- 设置页:可视化模式选择、ffmpeg 路径自定义与检测"""
commit = gh('git/commits', 'POST', body={'message': msg, 'tree': tree['sha'], 'parents': [base_sha]})
print('commit:', commit['sha'][:7])

gh('git/refs/heads/main', 'PATCH', body={'sha': commit['sha'], 'force': False})
print('PUSHED via API:', commit['sha'][:7])
